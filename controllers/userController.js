import User from "../models/UserModel.js"
import { sendEmail } from '../utils/email.js';
import jwt from 'jsonwebtoken';
import { formatErrorResponse } from "../utils/formatResponErr.js";
import bcrypt from "bcrypt";
import { OAuth2Client } from "google-auth-library"
import db from "../config/db.js";
const client = new OAuth2Client();

const signToken = id => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const refreshToken = id => {
  return jwt.sign({ id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  });
};

export const userController = {
  register: async (req, res) => {
    try {
      const newUser = await User.create(req.body);

      const token = signToken(newUser.id);

      const verificationURL = `${process.env.CLIENT_URL}/user/activation/${token}`
      console.log(verificationURL)


      sendEmail(newUser.email, verificationURL, "Verify your email address");

      res.json({
        data: {
          user: newUser,
        }, message: "Register Success! Please activate your email to start."
      })
    } catch (err) {
      res.status(400).json({
        status: 'failed',
        message: formatErrorResponse(err),
      });
    }
  },
  resendEmail: async (req, res) => {
    try {
      console.log(req)
      const user = await User.findOne({ where: { id: req.params.id } })
      if (user.emailVerified) {
        res.status(400).json({
          message: 'Email have been verified'
        })
      }
      const token = signToken(req.params.id);
      const verificationURL = `${process.env.CLIENT_URL}/user/activation/${token}`

      console.log(verificationURL)

      sendEmail(user.email, verificationURL, "Verify your email address");

      res.json({
        message: "Email berhasil dikirim"
      })
    } catch (err) {
      res.status(400).json({
        status: 'failed',
        message: err.message,
      });
    }
  },
  activateEmail: async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({
          message: 'Verification token is required'
        });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findOne({ where: { id: decoded.id } });

      if (!user) {
        return res.status(400).json({
          message: 'Invalid Token'
        });
      }

      if (user.isEmailVerified) {
        return res.status(400).json({
          message: "Email is already verified"
        });
      }

      user.emailVerified = true;
      await user.save();

      const refresh_token = refreshToken({ id: user._id })
      res.cookie('refreshtoken', refresh_token, {
        httpOnly: true,
        path: '/user/refresh_token',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      })

      res.status(200).json({
        data: {
          user,
          access_token: token
        },
        message: 'Email verified successfully'
      });

    } catch (err) {
      return res.status(500).json({ message: err.message })
    }
  },
  login: async (req, res) => {
    try {
      const { email, password } = req.body
      const user = await User.findOne({ where: { email: email } })

      const isMatch = await bcrypt.compare(password, user?.password || '')
      if (!user || !isMatch) return res.status(400).json({ message: "Email or Password is Incorrect" })


      const refresh_token = refreshToken({ id: user.id })
      const access_token = signToken({ id: user.id })
      res.cookie('refreshtoken', refresh_token, {
        httpOnly: true,
        path: '/user/refresh-token',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      })

      user.countLogin += 1;
      user.active = 1;
      user.logoutAt = null;
      await user.save();

      res.json({
        data: {
          user,
          access_token
        },
        message: "Login success!"
      })
    } catch (err) {
      return res.status(500).json({ message: err.message })
    }
  },
  getAccessToken: (req, res) => {
    try {
      const rf_token = req.cookies.refreshtoken
      if (!rf_token) return res.status(400).json({ message: "Please login now!" })

      jwt.verify(rf_token, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
        if (err) return res.status(400).json({ message: "Please login now!" })

        const access_token = signToken({ id: user.id?.id })
        res.json({ access_token })
      })
    } catch (err) {
      return res.status(500).json({ message: err.message })
    }
  },
  getActiveUser: async (req, res) => {
    try {
      const [rows] = await db.query(`
        SELECT 
          DATE(NOW() - INTERVAL n DAY) AS date,
          COUNT(*) AS active_users
        FROM 
          (SELECT @num := @num + 1 AS n
           FROM (SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7) t1,
                (SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7) t2,
                (SELECT @num := -1) t3
          ) days
        LEFT JOIN users
          ON DATE(users.logoutAt) = DATE(NOW() - INTERVAL days.n DAY) 
          OR users.logoutAt IS NULL
        WHERE 
          users.logoutAt >= NOW() - INTERVAL 7 DAY
        GROUP BY 
          days.n
        ORDER BY 
          date;
      `);

      const count = await User.count({
        where: {
          active: 1
        }
      });

      // Hitung rata-rata
      const totalUsers = rows.reduce((sum, row) => sum + row.active_users, 0);
      const averageUsers = rows.length > 0 ? totalUsers / rows.length : 0;

      return res.json({
        data: {
          average: averageUsers,
          userActive: count
        },
        message: "success."
      })



    } catch (err) {
      return res.status(500).json({ message: err.message })
    }
  },
  resetPassword: async (req, res) => {
    try {
      const { oldPassword, password, confirm } = req.body

      const user = await User.findOne({ where: { id: req.params.id } })
      console.log(user)
      if (!user.social) {
        const isMatch = await bcrypt.compare(oldPassword, user?.password || '')
        if (!user || !isMatch) return res.status(400).json({ message: "Old Password is Incorrect" })
      }

      if (password !== confirm) return res.status(400).json({ message: "Password and confirm password are not the same" })

      user.password = bcrypt.hashSync(password, 12);
      user.social = 0
      await user.save()

      res.status(200).json({
        data: user, 
        message: "Password successfully changed!"
      })
    } catch (err) {
      return res.status(500).json({ message: err.message })
    }
  },
  logout: async (req, res) => {
    try {
      const user = await User.findOne({ where: { id: req.user.id?.id || req?.user?.id } })
      if (!user) {
        return res.status(404).json({
          message: 'User not found'
        });
      }

      user.logoutAt = new Date();
      user.active = 0
      await user.save();


      res.clearCookie('refreshtoken', { path: '/user/refresh_token' })
      return res.json({ message: "Logged out." })



    } catch (err) {
      return res.status(500).json({ message: err.message })
    }
  },
  updateUser: async (req, res) => {
    try {
      const { name } = req.body
      const user = await User.findOne({ where: { id: req.params.id } })
      if (!user) {
        return res.status(404).json({
          message: 'User not found'
        });
      }

      user.name = name
      await user.save();


      return res.json({
        data: user,
        message: "Berhasil Update data"
      })
    } catch (err) {
      return res.status(500).json({ message: err.message })
    }
  },
  getUsersAll: async (req, res) => {
    try {
      const users = await User.findAll()

      res.status(200).json({
        data: users,
        message: "success"
      })
    } catch (err) {
      return res.status(500).json({ msg: err.message })
    }
  },
  googleLogin: async (req, res) => {
    try {
      const { credential, client_id } = req.body;
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: client_id,
      });
      const { name, email, email_verified } = ticket.getPayload();

      const password = email + process.env.MAILING_SERVICE_CLIENT_SECRET

      // const passwordHash = await bcrypt.hash(password, 12)

      if (!email_verified) return res.status(400).json({ msg: "Email verification failed." })

      const user = await User.findOne({ where: { email: email } })

      if (user) {
        user.active = 1;
        user.logoutAt= null
        await user.save()
        const refresh_token = refreshToken({ id: user.id })
        const access_token = signToken({ id: user.id })
        res.cookie('refreshtoken', refresh_token, {
          httpOnly: true,
          path: '/user/refresh_token',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        })

        res.json({
          data: {
            user,
            access_token
          },
          message: "Login success!"
        })
      } else {
        const newUser = await User.create
          ({
            name, email, password, countLogin: 1, emailVerified: 1, active: 1, social: 1
          })


        const refresh_token = refreshToken({ id: newUser.id })
        const access_token = signToken({ id: newUser.id })
        res.cookie('refreshtoken', refresh_token, {
          httpOnly: true,
          path: '/user/refresh_token',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        })

        res.json({
          data: {
            user: newUser,
            access_token
          },
          message: "Login success!"
        })
      }


    } catch (err) {
      return res.status(500).json({ msg: err.message })
    }
  },
  facebookLogin: async (req, res) => {
    try {

      const user = await User.findOne({ where: { email: req?.body?.email } })

      if (user) {
        user.active = 1;
        user.logoutAt= null
        await user.save()
        const refresh_token = refreshToken({ id: user.id })
        const access_token = signToken({ id: user.id })
        res.cookie('refreshtoken', refresh_token, {
          httpOnly: true,
          path: '/user/refresh_token',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        })

        res.json({
          data: {
            user,
            access_token
          },
          message: "Login success!"
        })
      } else {
        const body = {
          name: req?.body?.name,
          email: req.body?.email,
          password: req?.body?.email + process.env.FACEBOOK_API_ID_SECRET,
          social: 1,
          active: 1,
          emailVerified: 1
        }

        const newUser = await User.create(body)

        const refresh_token = refreshToken({ id: newUser.id })
        const access_token = signToken({ id: newUser.id })
        res.cookie('refreshtoken', refresh_token, {
          httpOnly: true,
          path: '/user/refresh_token',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        })

        res.json({
          data: {
            user: newUser,
            access_token
          },
          message: "Login success!"
        })
      }
    } catch (err) {
      res.status(400).json({
        status: 'failed',
        message: formatErrorResponse(err),
      });
    }
  },
}