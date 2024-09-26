import express from 'express';
import { promisify } from 'util';
import { createQueue } from 'kue';
import { createClient } from 'redis';

const app = express();
const client = createClient({ name: 'reserve_seat' });
const queue = createQueue();

const initialNumberOfSeats = process.env.NUMBER_OF_SEATS || 50;
const PORT = process.env.PORT || 1245;

let reservationEnabled = false;

async function reserveSeat(number) {
  return promisify(client.SET).bind(client)('available_seats', number);
};

async function getCurrentAvailableSeats() {
  return promisify(client.GET).bind(client)('available_seats');
};

async function resetNumberOfAvailableSeats(initialSeatsCount) {
  return promisify(client.SET)
    .bind(client)('available_seats', Number.parseInt(initialSeatsCount));
};

app.get('/available_seats', (_, res) => {
  getCurrentAvailableSeats()
    .then((numberOfAvailableSeats) => {
      res.json({ numberOfAvailableSeats })
    });
});

app.get('/reserve_seat', (_req, res) => {
  if (!reservationEnabled) {
    res.json({ status: 'Reservation are blocked' });
    return;
  }
  try {
    const job = queue.create('reserve_seat');

    job.on('failed', (err) => {
      console.log(
        'Seat reservation job',
        job.id,
        'failed:',
        err.message || err.toString(),
      );
    });
    job.on('complete', () => {
      console.log(
        'Seat reservation job',
        job.id,
        'completed'
      );
    });
    job.save();
    res.json({ status: 'Reservation in process' });
  } catch {
    res.json({ status: 'Reservation failed' });
  }
});

app.get('/process', (_req, res) => {
  res.json({ status: 'Queue processing' });
  queue.process('reserve_seat', (_job, done) => {
    getCurrentAvailableSeats()
      .then((result) => Number.parseInt(result || 0))
      .then((availableSeats) => {
        reservationEnabled = availableSeats <= 1 ? false : reservationEnabled;
        if (availableSeats >= 1) {
          reserveSeat(availableSeats - 1)
            .then(() => done());
        } else {
          done(new Error('Not enough seats available'));
        }
      });
  });
});


app.listen(PORT, () => {
  resetNumberOfAvailableSeats(initialNumberOfSeats)
    .then(() => {
      reservationEnabled = true;
      console.log(`API available on localhost port ${PORT}`);
    });
});

export default app;