import express from "express";
import { userController } from "../controllers/userController.js";
import {auth} from "../middleware/auth.js"

const router = express.Router();

router.post('/register', userController.register)
router.post('/activate-email', userController.activateEmail)
router.get('/resend-email/:id', userController.resendEmail)
router.post('/login', userController.login)
router.post('/refresh-token', userController.getAccessToken)
router.post('/reset-password/:id', auth, userController.resetPassword)
// router.get('/user-auth', auth, userController.getUserAuth)
router.get('/users', auth, userController.getUsersAll)
router.get('/logout', auth, userController.logout)
router.post('/google-login', userController.googleLogin)
router.post('/facebook-login', userController.facebookLogin)
router.post('/update/:id', auth, userController.updateUser)
router.get('/dashboard', auth, userController.getActiveUser)


export default router