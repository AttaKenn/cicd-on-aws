const assert = require('assert');
const calc = require('../calculator.js');

describe('Calculator Tests', () => {
	describe('Addition Tests', () => {
		it('returns 1 + 1 = 2', (done) => {
			assert.equal(calc.add(1, 1), 2);
			done();
		});

		it('returns 2 + -1 = 1', (done) => {
			assert.equal(calc.add(2, -1), 1);
			done();
		});
	});

	describe('Subtraction Tests', () => {
		it('returns 2 - 1 = 1', (done) => {
			assert.equal(calc.subtract(2, 1), 1);
			done();
		});

		it('returns 1 - -1 = 2', (done) => {
			assert.equal(calc.subtract(1, -1), 2);
			done();
		});
	});

	describe('Multiplication Tests', () => {
		it('returns 2 * 2 = 4', (done) => {
			assert.equal(calc.multiply(2, 2), 4);
			done();
		});

		it('returns 0 * 4 = 0', (done) => {
			assert.equal(calc.multiply(0, 4), 0);
			done();
		});
	});

	describe('Division Tests', () => {
		it('returns 4 / 2 = 2', (done) => {
			assert.equal(calc.divide(4, 2), 2);
			done();
		});

		it('returns 5 / 2 = 2.5', (done) => {
			assert.equal(calc.divide(5, 2), 2.5);
			done();
		});
	});

	describe('Exponential Tests', () => {
		it('returns 4 ^ 2 = 16', (done) => {
			assert.equal(calc.exponent(4, 2), 16);
			done();
		});

		it('returns 5 ^ 2 = 25', (done) => {
			assert.equal(calc.exponent(5, 2), 25);
			done();
		});
	});

});
