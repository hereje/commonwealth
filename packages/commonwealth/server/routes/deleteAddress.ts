import { AppError } from '@hicommonwealth/core';
import type { DB } from '@hicommonwealth/model';
import { WalletId } from '@hicommonwealth/shared';
import type { NextFunction, Request, Response } from 'express';

export const Errors = {
  NotLoggedIn: 'Not signed in',
  NeedAddress: 'Must provide address',
  NeedCommunity: 'Must provide community',
  AddressNotFound: 'Address not found',
  CannotDeleteMagic: 'Cannot delete Magic Link address',
};

const deleteAddress = async (
  models: DB,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { community } = req;

  if (!req.user) {
    return next(new AppError(Errors.NotLoggedIn));
  }
  if (!req.body.address) {
    return next(new AppError(Errors.NeedAddress));
  }
  if (!community) {
    return next(new AppError(Errors.NeedCommunity));
  }

  const addressObj = await models.Address.findOne({
    where: {
      community_id: community.id,
      address: req.body.address,
      user_id: req.user.id,
    },
  });
  if (!addressObj) {
    return next(new AppError(Errors.AddressNotFound));
  }
  if (addressObj.wallet_id === WalletId.Magic) {
    return next(new AppError(Errors.CannotDeleteMagic));
  }

  addressObj.profile_id = null;
  // @ts-expect-error StrictNullChecks
  addressObj.user_id = null;
  addressObj.verified = null;
  await addressObj.save();
  return res.json({ status: 'Success', response: 'Deleted address' });
};

export default deleteAddress;
