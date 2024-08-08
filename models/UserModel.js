import {Sequelize} from "sequelize";
import db from "../config/db.js";
import bcrypt from "bcrypt"

const {DataTypes} = Sequelize;

const passwordValidator = (password) => {
    const hasLowerCase = /[a-z]/.test(password);
    const hasUpperCase = /[A-Z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const isValidLength = password.length >= 8;
  
    return hasLowerCase && hasUpperCase && hasDigit && hasSpecialChar && isValidLength;
  };

const User = db.define('users',{
    name: DataTypes.STRING,
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: {
              args: true,
              msg: "Must be a valid email address",
            },
          },
    },
    countLogin: {
        type: DataTypes.BIGINT,
        defaultValue: 0
    },
    emailVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: 0
    },
    active: {
        type: DataTypes.BOOLEAN,
        defaultValue: 0
    },
    social: {
        type: DataTypes.BOOLEAN,
        defaultValue: 0
    },
    logoutAt: DataTypes.DATE,
    password: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          isValidPassword(value) {
            console.log(this.getDataValue('social'))
            if (!this.getDataValue('social')) {
              if (!passwordValidator(value)) {
                throw new Error('Password must contain at least one lower character, one upper character, one digit, one special character, and be at least 8 characters long.');
              }
            }
          },
        },
      },
},{
    hooks: {
      beforeCreate: (user) => {
        user.password = bcrypt.hashSync(user.password, 12);
      },
    },
    // defaultScope: {
    //     attributes: { exclude: ['password'] },
    // },
  });

//   User.prototype.toJSON = function () {
//     var values = Object.assign({}, this.get());

//     delete values.password;
//     return values;
// };

export default User;

(async()=>{
    await db.sync();
})();