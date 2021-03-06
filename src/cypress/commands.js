/* global Cypress,cy,window,before,after */
'use strict';
const {extractResources, domNodesToCdt} = require('@applitools/rendering-grid-client/browser');
const poll = require('./poll');
const makeSend = require('./makeSend');
const send = makeSend(Cypress.config('eyesPort'), cy.request);
const captureFrame = require('@applitools/dom-capture/src/captureFrame');
const defaultDomProps = require('@applitools/dom-capture/src/defaultDomProps');

before(() => {
  sendRequest({command: 'batchStart'});
});

const batchEnd = poll(function({timeout}) {
  return sendRequest({command: 'batchEnd', data: {timeout}});
});

after(() => {
  return batchEnd({timeout: Cypress.config('eyesTimeout')});
});

Cypress.Commands.add('eyesOpen', function(args = {}) {
  const {title: testName} = this.currentTest || this.test;
  Cypress.log({name: 'Eyes: open'});
  return sendRequest({command: 'open', data: Object.assign({testName}, args)});
});

Cypress.Commands.add('eyesCheckWindow', args => {
  let tag, sizeMode, selector, region, scriptHooks, ignore;
  if (typeof args === 'string') {
    tag = args;
  } else if (typeof args === 'object') {
    tag = args.tag;
    sizeMode = args.sizeMode;
    selector = args.selector;
    region = args.region;
    scriptHooks = args.scriptHooks;
    ignore = args.ignore;
  }

  Cypress.log({name: 'Eyes: check window'});
  return cy.document({log: false}).then(doc =>
    cy.window({log: false}).then(win => {
      const cdt = domNodesToCdt(doc);
      const domCapture = captureFrame(defaultDomProps);
      const url = win.location.href;
      return extractResources(doc, win).then(({resourceUrls, blobs}) => {
        const blobData = blobs.map(({url, type}) => ({url, type}));
        return Promise.all(blobs.map(putResource)).then(() =>
          sendRequest({
            command: 'checkWindow',
            data: {
              url,
              resourceUrls,
              cdt,
              tag,
              sizeMode,
              blobData,
              domCapture,
              selector,
              region,
              scriptHooks,
              ignore,
            },
          }),
        );
      });
    }),
  );
});

Cypress.Commands.add('eyesClose', () => {
  Cypress.log({name: 'Eyes: close'});
  return sendRequest({command: 'close'});
});

function sendRequest(args) {
  return send(args).then(resp => {
    if (!resp.body.success) {
      throw new Error(resp.body.error);
    }
    return resp.body.result;
  });
}

function putResource({url, type, value}) {
  return sendRequest({
    command: `resource/${encodeURIComponent(url)}`,
    data: new window.frameElement.ownerDocument.defaultView.Blob([value]), // yucky! cypress uses socket.io to communicate between browser and node. In order to encode the data in binary format, socket.io checks for binary values. But `value instanceof Blob` is falsy since Blob from the cypress runner window is not the Blob from the command's window. So using the Blob from cypress runner window here.
    method: 'PUT',
    headers: {'Content-Type': type},
  });
}
