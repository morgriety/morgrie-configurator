import {
  name,
  vendorId,
  productId,
} from '../../definitions/v3/morgrie/spacetime65/rkb65_via_v1_01_20261020.json';

// Display only: keep the firmware's productName and device identity untouched.
export const getDeviceDisplayName = (device: {
  vendorId: number;
  productId: number;
  productName?: string;
}): string =>
  device.vendorId === Number(vendorId) &&
  device.productId === Number(productId)
    ? name
    : device.productName || '';
