'use strict';

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { defineModel } = require('../lib/modelFactory');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ['student', 'teacher'], required: true, index: true },
    phone: { type: String, default: '' },
    avatar: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/** Hash plain-text passwords on save (Mongoose mode). */
userSchema.pre('save', async function hashPassword(next) {
  if (this.password && !String(this.password).startsWith('$2')) {
    this.password = await bcrypt.hash(String(this.password), 10);
  }
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.password) return Promise.resolve(false);
  if (!this.password.startsWith('$2')) return Promise.resolve(candidate === this.password);
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const { _id, name, email, role, phone, avatar, isActive, createdAt } = this;
  return { _id, name, email, role, phone, avatar, isActive, createdAt };
};

/** In-memory engine calls this after `create`, so hash here too. */
userSchema.statics.hashPassword = (plain) => bcrypt.hash(plain, 10);

const User = defineModel('User', userSchema);
module.exports = User;
module.exports.hashPassword = userSchema.statics.hashPassword;
