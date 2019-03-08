const express = require('express');

const { getAll, getById, post, patch, remove } = require('./todos');

/* todo importa frá todos.js */

const router = express.Router();

function catchErrors(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

router.get('/', catchErrors(getAll));
router.get('/:id', catchErrors(getById));
router.post('/', catchErrors(post));
router.patch('/:id', catchErrors(patch));
router.delete('/:id', catchErrors(remove));

module.exports = router;
