import { AppError } from '@hicommonwealth/core';
import type { DB } from '@hicommonwealth/model';
import type { NextFunction, Request, Response } from 'express';
import { getLastEdited } from 'server/util/getLastEdited';
import { sanitizeDeletedComment } from 'server/util/sanitizeDeletedComment';

export const Errors = {
  NoRootId: 'Must provide thread_id',
  InvalidId: 'Invalid thread_id',
};

const viewComments = async (
  models: DB,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { community } = req;
  const threadId = req.query.thread_id as string;

  if (!threadId) {
    return next(new AppError(Errors.NoRootId));
  }

  const parsedInt = parseInt(threadId, 10);
  if (isNaN(parsedInt) || parsedInt !== parseFloat(threadId)) {
    return next(new AppError(Errors.InvalidId));
  }

  const comments = await models.Comment.findAll({
    // @ts-expect-error StrictNullChecks
    where: { community_id: community.id, thread_id: threadId },
    include: [
      {
        model: models.Address,
        include: [
          {
            model: models.User,
            as: 'User',
            required: true,
            attributes: ['id', 'profile'],
          },
        ],
      },
      {
        model: models.Reaction,
        as: 'reactions',
        include: [
          {
            model: models.Address,
            as: 'Address',
            required: true,
            attributes: ['address', 'last_active'],
            include: [
              {
                model: models.User,
                as: 'User',
                required: true,
                attributes: ['id', 'profile'],
              },
            ],
          },
        ],
      },
    ],
    order: [['created_at', 'DESC']],
    paranoid: false,
  });

  const sanitizedComments = comments.map((c) => {
    const data = c.toJSON();
    return {
      ...sanitizeDeletedComment(data),
      last_edited: getLastEdited(data),
    };
  });

  return res.json({
    status: 'Success',
    result: sanitizedComments,
  });
};

export default viewComments;
