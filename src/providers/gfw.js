'use strict';

const Nightmare = require('nightmare');
const clui = require('clui');
const coinquirer = require('coinquirer');
const pkg = require('../../package.json');
const path = require('path');

const GFW = {
  name: 'GFW',

  login: function *(idpEntryUrl, username, password) {

    let ci = new coinquirer();
    username = username ? username : yield ci.prompt({
      type: 'input',
      message: 'GFW username (ex. user@domain.com):'
    });
    password = password ? password : yield ci.prompt({
      type: 'password',
      message: 'GFW password:'
    });

    let spinner = new clui.Spinner('Sending username...');
    spinner.start();

    let nightmare = Nightmare({
            show: true,
            openDevTools: { mode: 'detach' }
    });

    let hasError = yield nightmare
      .useragent(pkg.description + ' v.' + pkg.version)
      .goto(idpEntryUrl)
      .type('input[name="Email"]', username)
      .click('input[name="signIn"]')
      .wait('body')
      .exists('.error-msg:not(:empty)');
    spinner.stop();

    if (hasError) {
      let errMsg = yield nightmare.evaluate(function () {
        return document.querySelector('.error-msg').innerText;
      });
      yield fail(nightmare, errMsg);
    }

    spinner = new clui.Spinner('Sending password...');
    spinner.start();

    hasError = yield nightmare
      .type('input[name="Passwd"]', password)
      .click('input[name="signIn"]')
      .wait('body')
      .exists('.error-msg:not(:empty)');
    spinner.stop();

    if (hasError) {
      let errMsg = yield nightmare.evaluate(function () {
        return document.querySelector('.error-msg').innerText;
      });
      yield fail(nightmare, errMsg);
    }

    let verified = false;
    let hasSmartphoneVerification = yield nightmare.exists('iframe');

    if (hasSmartphoneVerification) {
      spinner = new clui.Spinner('Waiting for smartphone verification message...');
      spinner.start();

      yield nightmare.wait('body');

      hasError = yield nightmare.exists('#main_error:not(:empty)');

      verified = yield nightmare.exists('#saml_form');
      spinner.stop();
    } else {
      // Provide verify code
      let totp = yield ci.prompt({
        type: 'input',
        message: 'GFW multifactor authentication code:'
      });

      spinner = new clui.Spinner('Verifying...');
      spinner.start();

      yield nightmare
        .type('input[name="passcode"]', totp)
        .click('input[name="signIn"]')
        .wait('#main_error:not(:empty), input[name="SAMLResponse"]');

      hasError = yield nightmare.exists('#main_error:not(:empty)');

      if (hasError) {
        let errMsg = yield nightmare.evaluate(function () {
          return document.querySelector('#main_error').innerText;
        });
        yield fail(nightmare, errMsg);
      }

      let samlAssertion = yield nightmare
        .wait('input[name="SAMLResponse"]')
        .evaluate(function () {
          return document.querySelector('input[name="SAMLResponse"]').value;
        });

      spinner.stop();
    }

    //yield nightmare.end();
    return samlAssertion;
  }
};

function *fail(nightmare, errMsg) {
  if (!process.env.DEBUG) { return; }

  yield nightmare
    .screenshot(path.join(process.cwd(), '.debug', 'error.png'))
    .html(path.join(process.cwd(), '.debug', 'error.html'), 'HTMLComplete');

  throw new Error(errMsg);
}

module.exports = GFW;
