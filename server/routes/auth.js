const express = require('express')
const verifyJwt = require('express-jwt')

const {checkHash} = require('../auth/hash')
const {createUser, getUser, getUserById} = require('../db/users')
const {getToken} = require('../auth/token')

const router = express.Router()

router.post('/signin', signIn)
router.post('/register', register)
router.get('/refreshuser', verifyJwt({secret: process.env.JWT_SECRET}), refreshUser)

router.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    return res.status(403).json({ok: false, error: 'Access denied.'})
  }

  if (err) {
    return res.status(500).json({ok: false, error: 'Unknown error.'})
  }

  next()
})

function signIn (req, res) {
  const { username, password } = req.body

  return getUser(username)
    .then(user => {
      if (!user) {
        return res.status(400).json({
          ok: false,
          error: 'That user does not exist.'
        })
      }

      const { age, hash, id, username } = user

      checkHash(hash, password)
        .then(ok => {
          if (!ok) {
            return res.status(403).json({
              ok: false,
              error: 'Password incorrect.'
            })
          }

          const token = getToken(id)

          return res.status(201).json({
            ok: true,
            user: { age, id, username },
            token
          })
        })
    })
    .catch(() => res.status(500).json({
      ok: false,
      error: 'An unknown error occurred.'
    }))
}

function register (req, res) {
  const {username, password, age} = req.body
  createUser({username, password, age})
    .then(([id]) => {
      const token = getToken(id)
      res.status(201).json({
        ok: true,
        user: {id, username, age},
        token
      })
    })
    .catch((error) => {
      if (error.message.includes('UNIQUE constraint failed: users.username')) {
        return res.status(400).json({
          ok: false,
          error: 'That user already exists.'
        })
      }

      res.status(500).json({
        ok: false,
        error: 'An unknown error occurred.'
      })
    })
}

function refreshUser (req, res, next) {
  const {id} = req.user
  if (!id) {
    const e = new Error()
    e.name = 'UnauthorizedError'
    return next(e)
  }

  getUserById(id)
    .then(({id, username, age}) => {
      res.json({
        ok: true,
        user: {id, username, age}
      })
    })
    .catch(e => res.json({ok: false, error: 'Failed to retrieve user.'}))
}

module.exports = router
