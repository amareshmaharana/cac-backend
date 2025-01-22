import mongoose, { Schema } from 'mongoose';

const subscriptionSchema = new Schema(
  {
    subscriber: {
      type: Schema.Types.ObjectId, // the one who is subscribing -> a subscriber
      ref: 'User',
    },
    channel: {
      type: Schema.Types.ObjectId, // the one who is channel owner -> a subscriber subscribe to a user's channel
      ref: 'User',
    }
  },
  { timestamps: true },
);

export const Subscription = mongoose.model('Subscription', subscriptionSchema);
