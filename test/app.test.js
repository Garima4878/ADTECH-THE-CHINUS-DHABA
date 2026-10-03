const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');

test('GET /api/health returns success response', async () => {
  const response = await request(app).get('/api/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.message, 'Chinu Dhaba API is running');
});

test('Unknown routes return 404 payload', async () => {
  const response = await request(app).get('/api/not-found-route');

  assert.equal(response.status, 404);
  assert.equal(response.body.success, false);
  assert.equal(response.body.message, 'Route not found.');
});

test('Login validation fails for invalid email and missing password', async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: 'bad-email', password: '' });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.ok(Array.isArray(response.body.errors));
});
