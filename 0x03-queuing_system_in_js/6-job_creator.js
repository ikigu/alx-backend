import { createQueue } from 'kue';

const queue = createQueue({name: 'push_notification_code'});

const job = queue.create('push_notification_code', {
  phoneNumber: '0797049495',
  message: 'This is your verification code: 098-987',
});

job
  .on('enqueue', () => {
    console.log('Notification job created:', job.id);
  })
  .on('complete', () => {
    console.log('Notification job completed');
  })
  .on('failed attempt', () => {
    console.log('Notification job failed');
  });
job.save();