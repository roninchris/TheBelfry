In A Nutshell
=============

This is a pure Javascript implementation of Blowfish symmetric block
cipher algorithm.


Usage
=====

```
const blf = require('./blowfish.js');
const crypto = require('crypto');
{
	let key = crypto.randomBytes(32);
	let context = blf.key(key);
	let plaintext = 'Length is divisible by 8 to match the block size';
	let ciphertext = blf.ecb(context, Buffer.from(plaintext, 'utf8'));
	let decrypted = blf.ecb(context, ciphertext, true);
}
{
	let key = crypto.randomBytes(16);
	let iv = crypto.randomBytes(8);
	let context = blf.key(key);
	let plaintext = 'CBC mode also requires full blocks. Pad input data if necessary.';
	let ciphertext = blf.cbc(context, iv, Buffer.from(plaintext, 'utf8'));
	let decrypted = blf.cbc(context, iv, ciphertext, true);
}
{
	let key = crypto.randomBytes(16);
	let iv = crypto.randomBytes(8);
	let context = blf.key(key);
	let plaintext = 'Same with CFB. Full blocks only!';
	let ciphertext = blf.cfb(context, iv, Buffer.from(plaintext, 'utf8'));
	let decrypted = blf.cfb(context, iv, ciphertext, true);
}
{
	let key = crypto.randomBytes(16);
	let iv = crypto.randomBytes(8);
	let context = blf.key(key);
	let plaintext = 'With OFB, input length can be anything, but remember to use a unique IV every time! Encryption and decryption are identical in this mode.';
	let ciphertext = blf.ofb(context, iv, Buffer.from(plaintext, 'utf8'));
	let decrypted = blf.ofb(context, iv, ciphertext, true);
}
```


Compliance
==========

Test vectors are included into the package. Results of ecb, cbc, cfb,
and ofb functions are identical to nodejs crypto subsystem cipher
algorithms bf-ecb, bf-cbc, bf-cfb, and bf-ofb respectively.


Author
======

Timo J. Rinne <tri@iki.fi>


License
=======

GPL-2.0
