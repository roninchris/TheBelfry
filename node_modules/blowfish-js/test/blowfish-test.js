'use strict';

const crypto = require('crypto');
const blf = require('../blowfish.js');

var testVec = [
	{ m: 'ECB',
	  k: '0000000000000000',
	  p: '0000000000000000',
	  c: '4ef997456198dd78' },
	{ m: 'ECB',
	  k: 'ffffffffffffffff',
	  p: 'ffffffffffffffff',
	  c: '51866fd5b85ecb8a' },
	{ m: 'ECB',
	  k: '3000000000000000',
	  p: '1000000000000001',
	  c: '7d856f9a613063f2' },
	{ m: 'ECB',
	  k: '1111111111111111',
	  p: '1111111111111111',
	  c: '2466dd878b963c9d' },
	{ m: 'ECB',
	  k: '0123456789abcdef',
	  p: '1111111111111111',
	  c: '61f9c3802281b096' },
	{ m: 'ECB',
	  k: '1111111111111111',
	  p: '0123456789abcdef',
	  c: '7d0cc630afda1ec7' },
	{ m: 'ECB',
	  k: '0000000000000000',
	  p: '0000000000000000',
	  c: '4ef997456198dd78' },
	{ m: 'ECB',
	  k: 'fedcba9876543210',
	  p: '0123456789abcdef',
	  c: '0aceab0fc6a0a28d' },
	{ m: 'ECB',
	  k: '7ca110454a1a6e57',
	  p: '01a1d6d039776742',
	  c: '59c68245eb05282b' },
	{ m: 'ECB',
	  k: '0131d9619dc1376e',
	  p: '5cd54ca83def57da',
	  c: 'b1b8cc0b250f09a0' },
	{ m: 'ECB',
	  k: '07a1133e4a0b2686',
	  p: '0248d43806f67172',
	  c: '1730e5778bea1da4' },
	{ m: 'ECB',
	  k: '3849674c2602319e',
	  p: '51454b582ddf440a',
	  c: 'a25e7856cf2651eb' },
	{ m: 'ECB',
	  k: '04b915ba43feb5b6',
	  p: '42fd443059577fa2',
	  c: '353882b109ce8f1a' },
	{ m: 'ECB',
	  k: '0113b970fd34f2ce',
	  p: '059b5e0851cf143a',
	  c: '48f4d0884c379918' },
	{ m: 'ECB',
	  k: '0170f175468fb5e6',
	  p: '0756d8e0774761d2',
	  c: '432193b78951fc98' },
	{ m: 'ECB',
	  k: '43297fad38e373fe',
	  p: '762514b829bf486a',
	  c: '13f04154d69d1ae5' },
	{ m: 'ECB',
	  k: '07a7137045da2a16',
	  p: '3bdd119049372802',
	  c: '2eedda93ffd39c79' },
	{ m: 'ECB',
	  k: '04689104c2fd3b2f',
	  p: '26955f6835af609a',
	  c: 'd887e0393c2da6e3' },
	{ m: 'ECB',
	  k: '37d06bb516cb7546',
	  p: '164d5e404f275232',
	  c: '5f99d04f5b163969' },
	{ m: 'ECB',
	  k: '1f08260d1ac2465e',
	  p: '6b056e18759f5cca',
	  c: '4a057a3b24d3977b' },
	{ m: 'ECB',
	  k: '584023641aba6176',
	  p: '004bd6ef09176062',
	  c: '452031c1e4fada8e' },
	{ m: 'ECB',
	  k: '025816164629b007',
	  p: '480d39006ee762f2',
	  c: '7555ae39f59b87bd' },
	{ m: 'ECB',
	  k: '49793ebc79b3258f',
	  p: '437540c8698f3cfa',
	  c: '53c55f9cb49fc019' },
	{ m: 'ECB',
	  k: '4fb05e1515ab73a7',
	  p: '072d43a077075292',
	  c: '7a8e7bfa937e89a3' },
	{ m: 'ECB',
	  k: '49e95d6d4ca229bf',
	  p: '02fe55778117f12a',
	  c: 'cf9c5d7a4986adb5' },
	{ m: 'ECB',
	  k: '018310dc409b26d6',
	  p: '1d9d5c5018f728c2',
	  c: 'd1abb290658bc778' },
	{ m: 'ECB',
	  k: '1c587f1c13924fef',
	  p: '305532286d6f295a',
	  c: '55cb3774d13ef201' },
	{ m: 'ECB',
	  k: '0101010101010101',
	  p: '0123456789abcdef',
	  c: 'fa34ec4847b268b2' },
	{ m: 'ECB',
	  k: '1f1f1f1f0e0e0e0e',
	  p: '0123456789abcdef',
	  c: 'a790795108ea3cae' },
	{ m: 'ECB',
	  k: 'e0fee0fef1fef1fe',
	  p: '0123456789abcdef',
	  c: 'c39e072d9fac631d' },
	{ m: 'ECB',
	  k: '0000000000000000',
	  p: 'ffffffffffffffff',
	  c: '014933e0cdaff6e4' },
	{ m: 'ECB',
	  k: 'ffffffffffffffff',
	  p: '0000000000000000',
	  c: 'f21e9a77b71c49bc' },
	{ m: 'ECB',
	  k: '0123456789abcdef',
	  p: '0000000000000000',
	  c: '245946885754369a' },
	{ m: 'ECB',
	  k: 'fedcba9876543210',
	  p: 'ffffffffffffffff',
	  c: '6b5c5a9c5d9e0a5a' },
	{ m: 'CBC',
	  k: '0123456789abcdeff0e1d2c3b4a59687',
	  i: 'fedcba9876543210',
	  p: '37363534333231204e6f77206973207468652074696d6520666f722000000000',
	  c: '6b77b4d63006dee605b156e27403979358deb9e7154616d959f1652bd5ff92cc' },
	{ m: 'CFB',
	  k: '0123456789abcdeff0e1d2c3b4a59687',
	  i: 'fedcba9876543210',
	  p: '37363534333231204e6f77206973207468652074696d6520666f722000',
	  c: 'e73214a2822139caf26ecf6d2eb9e76e3da3de04d1517200519d57a6c3' },
	{ m: 'OFB',
	  k: '0123456789abcdeff0e1d2c3b4a59687',
	  i: 'fedcba9876543210',
	  p: '37363534333231204e6f77206973207468652074696d6520666f722000',
	  c: 'e73214a2822139ca62b343cc5b65587310dd908d0c241b2263c2cf80da' }
];

function t1(tc, ec) {
	testVec.forEach(function(v) {
		var k, i, p, c, pp;
		tc++;
		k = blf.key(Buffer.from(v.k, 'hex'));
		i = v.i ? Buffer.from(v.i, 'hex') : undefined;
		p = Buffer.from(v.p, 'hex');
		switch (v.m) {
		case 'ECB':
			c = blf.ecb(k, p, false);
			break;
		case 'CBC':
			c = blf.cbc(k, i, p, false);
			break;
		case 'CFB':
			c = blf.cfb(k, i, p, false);
			break;
		case 'OFB':
			c = blf.ofb(k, i, p, false);
			break;
		default:
			ec++;
			console.error(v.m + ' mode for test #' + tc.toString() + ' is not supported.');
			return [tc, ec];
		}
		if (! (c && (c.toString('hex') === v.c))) {
			ec++;
			console.error(v.m + ' mode encryption step of test #' + tc.toString() + ' failed.');
			return [tc, ec];
		}
		switch (v.m) {
		case 'ECB':
			pp = blf.ecb(k, c, true);
			break;
		case 'CBC':
			pp = blf.cbc(k, i, c, true);
			break;
		case 'CFB':
			pp = blf.cfb(k, i, c, true);
			break;
		case 'OFB':
			pp = blf.ofb(k, i, c, true);
			break;
		default:
			ec++;
			console.error(v.m + ' mode for test #' + tc.toString() + ' is not supported.');
			return [tc, ec];
		}
		if (! (pp && (pp.toString('hex') === v.p))) {
			ec++;
			console.error(v.m + ' mode decryption step of test #' + tc.toString() + ' failed.');
			return [tc, ec];
		}
	});
	return [tc, ec];
}

function t2(tc, ec) {
	for (let i = 0; i < 10; i++) {
		tc++;
		let key_ecb = crypto.randomBytes(16);
		let key_cbc = crypto.randomBytes(25);
		let key_cfb = crypto.randomBytes(30);
		let key_ofb = crypto.randomBytes(51);
		let iv_cbc = crypto.randomBytes(8);
		let iv_cfb = crypto.randomBytes(8);
		let iv_ofb = crypto.randomBytes(8);
		let cc_ecb = blf.key(key_ecb);
		let cc_cbc = blf.key(key_cbc);
		let cc_cfb = blf.key(key_cfb);
		let cc_ofb = blf.key(key_ofb);
		let input = Buffer.alloc(2048);
		let ii = Buffer.from(input);
		let cnt = 100;
		// Encrypt
		for (let j = 0; j < cnt + i; j++) {
			ii = blf.ecb(cc_ecb, ii);
			ii = blf.cbc(cc_cbc, iv_cbc, ii);
			ii = blf.cfb(cc_cfb, iv_cfb, ii);
			ii = blf.ofb(cc_ofb, iv_ofb, ii);
		}
		// Decrypt
		for (let j = 0; j < cnt + i; j++) {
			ii = blf.ofb(cc_ofb, iv_ofb, ii);
			ii = blf.cfb(cc_cfb, iv_cfb, ii, true);
			ii = blf.cbc(cc_cbc, iv_cbc, ii, true);
			ii = blf.ecb(cc_ecb, ii, true);
		}
		if (Buffer.compare(input, ii) != 0) {
			ec++;
			console.error('Torture test #' + i.toString() + ' fails to decrypt correctly.');
			continue;
		}
	}
	return [tc, ec];
}

function t3(tc, ec) {
	for (let i = 0; i < 16; i++) {
		[ 'ECB', 'CBC', 'CFB', 'OFB' ].forEach(function(mode) {
			tc++;
			let transform;
			let cipher_name;
			switch (mode) {
			case 'ECB':
				transform = blf.ecb;
				cipher_name = 'bf-ecb';
				break;
			case 'CBC':
				transform = blf.cbc;
				cipher_name = 'bf-cbc';
				break;
			case 'CFB':
				transform = blf.cfb;
				cipher_name = 'bf-cfb';
				break;
			case 'OFB':
				transform = blf.ofb;
				cipher_name = 'bf-ofb';
				break;
			default:
				ec++;
				console.error('Torture test #' + i.toString() + ' fails to initialize.');
				return;
			}
			let input = crypto.randomBytes(1024);
			let key = crypto.randomBytes(50);
			let iv = (mode === 'ECB') ? null : crypto.randomBytes(8);
			let cc = blf.key(key);
			let ci = crypto.createCipheriv(cipher_name, key, iv);
			let di = crypto.createDecipheriv(cipher_name, key, iv);
			let ct1 = (mode === 'ECB') ? transform(cc, input) : transform(cc, iv, input);
			let ct2;
			{
				ci.setAutoPadding(false);
				ct2 = ci.update(input);
				ct2 = Buffer.concat([ ct2, ci.final() ]);
			}
			if (Buffer.compare(ct1, ct2) != 0) {
				ec++;
				console.error('Output mismatch with system crypto.');
				return;
			}
			let pt1 = (mode === 'ECB') ? transform(cc, ct1, true) : transform(cc, iv, ct1, true);
			if (Buffer.compare(pt1, input) != 0) {
				ec++;
				console.error(mode + ' comparison test fails to decrypt correctly with JS.');
				return;
			}
			let pt2;
			{
				di.setAutoPadding(false);
				pt2 = di.update(ct2);
				pt2 = Buffer.concat([ pt2, di.final() ]);
			}
			if (Buffer.compare(pt2, input) != 0) {
				ec++;
				console.error(mode + ' comparison test fails to decrypt correctly with system crypto.');
				return;
			}
		});
	}
	return [tc, ec];
}

(function() {
	var tc = 0, ec = 0;
	[ tc, ec ] = t1(tc, ec);
	[ tc, ec ] = t2(tc, ec);
	[ tc, ec ] = t3(tc, ec);
	if (ec) {
		console.error(ec.toString() + '/' + tc.toString() + ' tests failed.');
		process.exit(1);
	}
	console.log('All ' + tc.toString() + ' tests OK.');
	process.exit(0);
})();
