const validator = require('validator');

const xss = require('xss');

const { query } = require('./db');

/**
 * Hjálparfall sem XSS hreinsar reit í formi eftir heiti.
 *
 * @param {string} fieldName Heiti á reit
 * @returns {function} Middleware sem hreinsar reit ef hann finnst
 */
function sanitizeXss(fieldName) {
  return (req, res, next) => {
    if (!req.body) {
      next();
    }

    const field = req.body[fieldName];

    if (field) {
      req.body[fieldName] = xss(field);
    }

    next();
  };
}

/**
 * Check if argument is null, undefined or falsy.
 *
 * @param {string} s - Object to check
 *
 * @returns {Boolean} Boolean result of the check
 */
function isEmpty(s) {
  return s == null && !s;
}

/**
 * Gets and displays all assignments.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getAll(req, res) {
  let data = '';
  const desc = req.query.order === 'desc';
  const order = desc ? 'position desc' : 'position asc';
  const { completed } = req.query;
  if (typeof completed !== 'undefined') { // completed til staðar í query streng
    if (completed === 'true' || completed === 'false') {
      data = await query(`SELECT * FROM data WHERE completed = ${completed} ORDER BY ${order}`);
      res.json(data.rows);
    }
  } else { // completed ekki til staðar í query streng
    data = await query(`SELECT * FROM data ORDER BY ${order}`);
    res.json(data.rows);
  }
  res.status(400).json({ error: 'invalid query string' });
}

/**
 * Gets and displays assingment with id
 *
 * @param {Object} req - Express request object
 * @param {object} res - Express response object
 */
async function getById(req, res) {
  const { id } = req.params;
  const data = await query('select * from data');
  const result = data.rows.find(i => i.id === parseInt(id, 10));
  if (result) res.json(result);
  res.status(404).json({ error: 'Item not found' });
}

/**
 * Posts assingment to database
 *
 * @param {Object} req - Express request object
 * @param {object} res - Express response object
 */
async function post(req, res) {
  const { title, due, position, completed = false } = req.body;

  const errors = [];

  // Þetta gæti valdið vandræðum ef title mætti vera uppfært sem tómi strengur
  if (typeof title === 'undefined') {
    errors.push({
      field: 'title',
      error: 'Titil vantar',
    });
  } else if (typeof title !== 'string' || title.length === 0) {
    errors.push({
      field: 'title',
      error: 'Titill verður að vera strengur sem er 1 til 128 stafir',
    });
  }

  if (!isEmpty(due)) {
    if (!validator.isISO8601(due)) {
      errors.push({
        field: 'due',
        error: 'Dagsetning verður að vera gild ISO 8601 dagsetning',
      });
    }
  }

  if (!isEmpty(position)) {
    if (position < 0) {
      errors.push({
        field: 'position',
        error: 'Staðsetning verður að vera heiltala stærri eða jöfn 0',
      });
    }
  }

  if (!isEmpty(completed)) {
    if (typeof completed !== 'boolean') {
      errors.push({
        field: 'completed',
        error: 'Lokið verður að vera boolean gildi',
      });
    }
  }

  if (errors.length > 0) {
    return res.status(400).json(errors);
  }

  // Ef við komumst hingað búum við til nýja færslu
  sanitizeXss('title');
  sanitizeXss('due');
  sanitizeXss('position');
  sanitizeXss('completed');

  const item = [title, due, position, completed];
  const q = `
INSERT INTO data
(title, due, position, completed)
VALUES
($1, $2, $3, $4)`;

  await query(q, item);


  const newItem = await query('SELECT * FROM data ORDER BY id DESC LIMIT 1');

  return res.status(201).json(newItem.rows);
}

/**
 * Patches changes to assingment in database
 *
 * @param {Object} req - Express request object
 * @param {object} res - Express response object
 */
async function patch(req, res) {
  const { id } = req.params;
  // verðum að vita hvort gögnin séu send inn eða aðeins falsy
  const { title, due, position, completed } = req.body;
  const data = await query('select * from data');
  const item = data.rows.find(i => i.id === parseInt(id, 10));
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  // Ef við komumst hingað er hluturinn sem á að uppfæra til
  // Skoðum hvort gögn frá notanda séu í lagi
  const errors = [];

  // Þetta gæti valdið vandræðum ef title mætti vera uppfært sem tómi strengur
  if (!isEmpty(title)) {
    if (typeof title !== 'string' || title.length === 0) {
      errors.push({
        field: 'title',
        error: 'Titill verður að vera strengur sem er 1 til 128 stafir',
      });
    }
  }

  if (!isEmpty(due)) {
    if (!validator.isISO8601(due)) {
      errors.push({
        field: 'due',
        error: 'Dagsetning verður að vera gild ISO 8601 dagsetning',
      });
    }
  }

  if (!isEmpty(position)) {
    if (position < 0) {
      errors.push({
        field: 'position',
        error: 'Staðsetning verður að vera heiltala stærri eða jöfn 0',
      });
    }
  }

  if (!isEmpty(completed)) {
    if (typeof completed !== 'boolean') {
      errors.push({
        field: 'completed',
        error: 'Lokið verður að vera boolean gildi',
      });
    }
  }

  if (errors.length > 0) {
    return res.status(400).json(errors);
  }

  // Ef við komumst hingað þá eru gögn í lagi
  const q = ['UPDATE data SET'];
  const set = [];
  if (!isEmpty(title)) {
    sanitizeXss('title');
    item.title = title;
    set.push(`title = '${title}'`);
  }

  if (!isEmpty(due)) {
    sanitizeXss('due');
    item.due = due;
    set.push(`due = "${due}"`);
  }

  if (!isEmpty(position)) {
    sanitizeXss('position');
    item.position = position;
    set.push(`position = ${position}`);
  }

  if (!isEmpty(completed)) {
    sanitizeXss('completed');
    item.completed = completed;
    set.push(`completed = ${completed}`);
  }

  // Ef engu á að breyta
  if (set.length === 0) return res.status(200).json(item);

  q.push(set.join(', '));
  q.push(`WHERE id = ${id}`);

  await query(q.join(' '));

  return res.status(200).json(item);
}

/**
 * Removes assingment from database
 *
 * @param {Object} req - Express request object
 * @param {object} res - Express response object
 */
async function remove(req, res) {
  const { id } = req.params;
  const data = await query('select * from data');
  const item = data.rows.find(i => i.id === parseInt(id, 10));
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  // Ef við komumst hingað þá er verkefni til
  await query('DELETE FROM data WHERE id = $1', [id]);
  return res.status(204).json(item);
}


module.exports = {
  getAll,
  getById,
  post,
  patch,
  remove,
};
