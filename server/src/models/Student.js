'use strict';

const mongoose = require('../lib/modelFactory').mongoose;
const { defineModel } = require('../lib/modelFactory');

const studentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    rollNo: { type: String, required: true, unique: true, trim: true, index: true },
    admissionNo: { type: String, default: '' },
    className: { type: String, required: true, index: true }, // e.g. "TE-A"
    department: { type: String, default: 'Computer Engineering' },
    semester: { type: Number, default: 5 },
    division: { type: String, default: 'A' },
    batch: { type: String, default: '' },
    gender: { type: String, enum: ['male', 'female', 'other', ''], default: '' },
    dateOfBirth: { type: Date, default: null },
    bloodGroup: { type: String, default: '' },
    address: { type: String, default: '' },
    guardian: {
      name: { type: String, default: '' },
      relation: { type: String, default: 'Parent' },
      phone: { type: String, default: '' }, // WhatsApp number in E.164, e.g. +919000000001
      email: { type: String, default: '' },
      whatsappOptIn: { type: Boolean, default: true },
    },
    subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
    status: { type: String, enum: ['active', 'inactive', 'alumni'], default: 'active' },
    photo: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

studentSchema.virtual('displayName').get(function displayName() {
  return this.user && this.user.name ? this.user.name : this.rollNo;
});

studentSchema.index({ className: 1, rollNo: 1 });

module.exports = defineModel('Student', studentSchema);
