import {definitionForDevice, type DefinitionDictionary} from './model-definitions';
import {AuthorizedDevice, ConnectedDevice} from 'src/types/types';

export function isNotNullish<A>(a: A | undefined | null): a is A {
  return a !== undefined && a !== null;
}

export function isFulfilledPromise<A>(
  a: PromiseSettledResult<A>,
): a is PromiseFulfilledResult<A> {
  return a.status === 'fulfilled';
}

export function isAuthorizedDeviceConnected(
  device: AuthorizedDevice,
  definitions?: DefinitionDictionary,
) {
  return (
    definitions &&
    definitionForDevice(device, definitions)
  );
}
