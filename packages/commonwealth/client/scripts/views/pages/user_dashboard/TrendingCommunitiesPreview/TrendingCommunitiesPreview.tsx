import { useCommonNavigate } from 'navigation/helpers';
import React from 'react';
import app from 'state';
import useUserStore from 'state/ui/user';
import { CWText } from '../../../components/component_kit/cw_text';
import { CommunityPreviewCard } from './CommunityPreviewCard';
import './TrendingCommunitiesPreview.scss';

export const TrendingCommunitiesPreview = () => {
  const navigate = useCommonNavigate();
  const user = useUserStore();

  const sortedCommunities = app.config.chains
    .getAll()
    .filter((community) => {
      const name = community.name.toLowerCase();
      //this filter is meant to not include any de facto communities that are actually xss attempts.
      //It's a way of keeping the front facing parts of the app clean looking for users
      return (
        !['"', '>', '<', "'", '/', '`'].includes(name[0]) &&
        !['"', '>', '<', "'", '/', '`'].includes(name[1])
      );
    })
    .sort((a, b) => {
      const threadCountA = app.recentActivity.getCommunityThreadCount(a.id);
      const threadCountB = app.recentActivity.getCommunityThreadCount(b.id);
      return threadCountB - threadCountA;
    })
    .map((community) => {
      const monthlyThreadCount = app.recentActivity.getCommunityThreadCount(
        community.id,
      );
      const isMember = app.roles.isMember({
        account: user.activeAccount || undefined,
        community: community.id,
      });

      return {
        community,
        monthlyThreadCount,
        isMember,
        // TODO: should we remove the new label once user visits the community? -- ask from product
        hasUnseenPosts: user.joinedCommunitiesWithNewContent.includes(
          community.id,
        ),
        onClick: () => navigate(`/${community.id}`),
      };
    });

  return (
    <div className="TrendingCommunitiesPreview">
      <CWText type="h4" className="header">
        Trending Communities
      </CWText>
      <div className="community-preview-cards-collection">
        {(sortedCommunities.length > 3
          ? sortedCommunities.slice(0, 3)
          : sortedCommunities
        ).map((sortedCommunity, index) => (
          <CommunityPreviewCard
            key={index}
            community={sortedCommunity.community}
            monthlyThreadCount={sortedCommunity.monthlyThreadCount}
            isCommunityMember={sortedCommunity.isMember}
            hasUnseenPosts={sortedCommunity.hasUnseenPosts}
            onClick={sortedCommunity.onClick}
          />
        ))}
        <CommunityPreviewCard
          isExploreMode
          onClick={() => {
            navigate('/communities');
          }}
        />
      </div>
    </div>
  );
};
