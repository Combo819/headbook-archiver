import { getRepostCommentApi } from './repostCommentApi';
import camelcaseKeys from 'camelcase-keys';
import { map, asyncify } from 'async';
import {
  RepostCommentCrawlerParams,
  IRepostCommentService,
  IRepostCommentCrawler,
  IRepostComment,
  REPOST_COMMENT_IOC_SYMBOLS,
} from '../Types';
import { IPostService, PostDocument, POST_IOC_SYMBOLS } from '../../Post/Types';
import { asyncPriorityQueuePush } from '../../../Jobs/Queue';
import { Q_PRIORITY } from '../../../Config';
import { injectable, inject } from 'inversify';
import dayjs from 'dayjs';
import { IUserService, USER_IOC_SYMBOLS } from '../../User/Types';
import { container } from '../../../Config/inversify.config';
import { NotImplementedError } from '../../../Error/ErrorClass';
import { ICommentService } from '../../Comment/Types';
@injectable()
class RepostCommentCrawler implements IRepostCommentCrawler {
  private repostCommentService!: IRepostCommentService;
  private userService: IUserService;
  private postService!: IPostService;
  constructor(
    @inject(USER_IOC_SYMBOLS.IUserService)
    userService: IUserService,
  ) {
    this.userService = userService;
  }

  lazyInject() {
    this.repostCommentService = container.get<IRepostCommentService>(
      REPOST_COMMENT_IOC_SYMBOLS.IRepostCommentService,
    );
    this.postService = container.get<IPostService>(
      POST_IOC_SYMBOLS.IPostService,
    );
  }

  startCrawling = (postId: string) => {
    asyncPriorityQueuePush(
      this.crawl,
      { postId, page: 1, pageSize: 10 },
      Q_PRIORITY.CRAWLER_REPOST_COMMENT,
    );
  };

  private crawl = async (params: RepostCommentCrawlerParams) => {
    const { postId, page, pageSize } = params;
    const res = await getRepostCommentApi(postId, page, pageSize);
    const { usersRaw, infos } = this.scrapeInfoUser(res, postId);
    const nextParams = this.transformNextParams(res, params);
    map(infos, asyncify(this.repostCommentService.save));
    map(
      usersRaw.map((userRaw) =>
        this.userService.transformUserResponse(userRaw),
      ),
      asyncify(this.userService.save),
    );
    this.postService.addRepostComments(
      infos.map((repostComments) => repostComments.id),
      postId,
    );
    if (nextParams) {
      asyncPriorityQueuePush(
        this.crawl,
        nextParams,
        Q_PRIORITY.CRAWLER_REPOST_COMMENT,
      );
    }
  };

  /**
   * take in the response from the API and transform it into the nextParams for the next request, and the infos of the comments,and the users
   * @param res the axios api response object
   * @param prevParams previous params
   * @returns {nextParams, infos, usersRaw}
   */
  private scrapeInfoUser(
    res: any,
    postId: string,
  ): {
    infos: IRepostComment[];
    usersRaw: unknown[];
  } {
    const { repostComments } = res.data;
    const infos: IRepostComment[] = repostComments.map(
      (repostCommentRaw: any) => {
        return {
          id: repostCommentRaw.id,
          content: repostCommentRaw.content,
          user: repostCommentRaw.user.id,
          createTime: repostCommentRaw.createTime,
          repostedId: postId,
          saveTime: dayjs().valueOf(),
        };
      },
    );
    const usersRaw: unknown[] = repostComments.map(
      (comment: any) => comment.user,
    );
    return {
      infos,
      usersRaw,
    };
  }

  private transformNextParams(
    res: any,
    prevParams: RepostCommentCrawlerParams,
  ): RepostCommentCrawlerParams | null {
    const { postId, page, pageSize } = prevParams;
    const { repostComments } = res.data;
    if (repostComments.length === 0) {
      // no more repost comment
      return null;
    }
    return {
      postId,
      page: page + 1,
      pageSize,
    };
  }
}

export { RepostCommentCrawler };
