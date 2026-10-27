import mongoose from 'mongoose';
// Set before model registration; existing collections and indexes remain untouched.
mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);
