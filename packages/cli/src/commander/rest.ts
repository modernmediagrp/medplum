import { Command } from 'commander';
import { cleanUrl, prettyPrint } from '..';
import { medplum } from '.';
import { convertToTransactionBundle } from '@medplum/core';

export const deleteObject = new Command('delete');
export const get = new Command('get');
export const patch = new Command('patch');
export const post = new Command('post');
export const put = new Command('put');

deleteObject.argument('<url>', 'Resource/$id').action(async (url) => {
  prettyPrint(await medplum.delete(cleanUrl(url)));
});

get
  .argument('<url>', 'Resource/$id')
  .option('--as-transaction', 'Print out the bundle as a transaction type')
  .action(async (url, options) => {
    const response = await medplum.get(cleanUrl(url));
    if (options.asTransaction) {
      prettyPrint(convertToTransactionBundle(response));
    } else {
      prettyPrint(response);
    }
  });

patch.arguments('<url> <body>').action(async (url, body) => {
  prettyPrint(await medplum.patch(cleanUrl(url), parseBody(body)));
});

post.arguments('<url> <body>').action(async (url, body) => {
  prettyPrint(await medplum.post(cleanUrl(url), parseBody(body)));
});

put.arguments('<url> <body>').action(async (url, body) => {
  prettyPrint(await medplum.post(cleanUrl(url), parseBody(body)));
});

function parseBody(input: string | undefined): any {
  if (!input) {
    return undefined;
  }
  try {
    return JSON.parse(input);
  } catch (err) {
    return input;
  }
}
