import { factory, formatFilename } from 'common-common/src/logging';
import { toBN } from 'web3-utils';
import { ChainNodeInstance } from '../../../models/chain_node';
import { rollbar } from '../../rollbar';
import { Balances } from '../types';
import {
  evmBalanceFetcherBatching,
  evmOffChainRpcBatching,
  mapNodeToBalanceFetcherContract,
} from '../util';

const log = factory.getLogger(formatFilename(__filename));

export type GetEthBalancesOptions = {
  chainNode: ChainNodeInstance;
  addresses: string[];
};

export async function __getEthBalances(options: GetEthBalancesOptions) {
  if (options.addresses.length === 0) {
    return {};
  }

  const rpcEndpoint = options.chainNode.private_url || options.chainNode.url;
  if (options.addresses.length === 1) {
    return await getEthBalance(
      options.chainNode.eth_chain_id,
      rpcEndpoint,
      options.addresses[0],
    );
  }

  const balanceFetcherContract = mapNodeToBalanceFetcherContract(
    options.chainNode.eth_chain_id,
  );
  if (balanceFetcherContract) {
    return await getOnChainBatchEthBalances(
      options.chainNode.eth_chain_id,
      rpcEndpoint,
      options.addresses,
    );
  } else {
    return await getOffChainBatchEthBalances(
      options.chainNode.eth_chain_id,
      rpcEndpoint,
      options.addresses,
    );
  }
}

async function getOnChainBatchEthBalances(
  evmChainId: number,
  rpcEndpoint: string,
  addresses: string[],
): Promise<Balances> {
  const { balances } = await evmBalanceFetcherBatching(
    {
      evmChainId,
      url: rpcEndpoint,
    },
    {
      batchSize: 1000,
    },
    addresses,
  );

  return balances;
}

async function getOffChainBatchEthBalances(
  evmChainId: number,
  rpcEndpoint: string,
  addresses: string[],
): Promise<Balances> {
  const { balances } = await evmOffChainRpcBatching(
    {
      evmChainId,
      url: rpcEndpoint,
    },
    {
      method: 'eth_getBalance',
      getParams: (abiCoder, address, tokenAddress) => {
        return address;
      },
      batchSize: 1000,
    },
    addresses,
  );
  return balances;
}

async function getEthBalance(
  evmChainId: number,
  rpcEndpoint: string,
  address: string,
): Promise<Balances> {
  const requestBody = {
    method: 'eth_getBalance',
    params: [address, 'latest'],
    id: 1,
    jsonrpc: '2.0',
  };

  const response = await fetch(rpcEndpoint, {
    method: 'POST',
    body: JSON.stringify(requestBody),
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await response.json();

  if (data.error) {
    const msg =
      `Eth balance fetch failed for address ${address} ` +
      `on evm chain id ${evmChainId}`;
    rollbar.error(msg, data.error);
    log.error(msg, data.error);
    return {};
  } else {
    return {
      [address]: toBN(data.result).toString(10),
    };
  }
}