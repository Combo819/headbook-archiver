import { getCommentApi } from './commentApi';
import { IPostService, PostDocument, POST_IOC_SYMBOLS } from '../../Post/Types';
import camelcaseKeys from 'camelcase-keys';
import {
  ICommentService,
  CommentCrawlParams,
  IComment,
  COMMENT_IOC_SYMBOLS,
} from '../Types';
import { asyncPriorityQueuePush } from '../../../Jobs/Queue';
import { Q_PRIORITY } from '../../../Config';
import { injectable, inject } from 'inversify';
import 'reflect-metadata';
import dayjs from 'dayjs';
import { IAccountService, ACCOUNT_IOC_SYMBOLS } from '../../Account/Types';
import { IUserService, USER_IOC_SYMBOLS } from '../../User/Types';
import {
  ISubCommentService,
  SUB_COMMENT_IOC_SYMBOLS,
} from '../../SubComment/Types';
import { ImageServiceInterface, IMAGE_IOC_SYMBOLS } from '../../Image/Types';
import { container } from '../../../Config/inversify.config';
import { getUrlLastSegment } from '../../../Utility/urlParse';
import { NotImplementedError } from '../../../Error/ErrorClass';
@injectable()
class CommentCrawler {
  private postService!: IPostService;
  private commentService!: ICommentService;
  private userService: IUserService;
  private subCommentService: ISubCommentService;
  private imageService: ImageServiceInterface;
  constructor(
    @inject(ACCOUNT_IOC_SYMBOLS.IAccountService)
    accountService: IAccountService,
    @inject(USER_IOC_SYMBOLS.IUserService)
    userService: IUserService,
    @inject(SUB_COMMENT_IOC_SYMBOLS.ISubCommentService)
    subCommentService: ISubCommentService,
    @inject(IMAGE_IOC_SYMBOLS.ImageServiceInterface)
    imageService: ImageServiceInterface,
  ) {
    this.userService = userService;
    this.subCommentService = subCommentService;
    this.imageService = imageService;
  }

  lazyInject() {
    this.postService = container.get<IPostService>(
      POST_IOC_SYMBOLS.IPostService,
    );
    this.commentService = container.get<ICommentService>(
      COMMENT_IOC_SYMBOLS.ICommentService,
    );
  }

  startCrawling = (postId: string) => {
    asyncPriorityQueuePush(
      this.crawl,
      {
        postId,
        page: 1,
        pageSize: 10,
      },
      Q_PRIORITY.CRAWLER_COMMENT,
    );
  };

  private crawl = async (params: CommentCrawlParams) => {
    const { postId, page, pageSize } = params;
    const res = await getCommentApi(postId, page, pageSize);

    const { infos, usersRaw } = this.scrapeData(res, postId);
    const nextParams = this.transformNextParams(res, params);

    // save comment to database
    infos.forEach(async (comment: IComment) => {
      if (comment.image) {
        this.imageService.downloadImage(comment.image.originUrl);
      }
      const commentDoc = await this.commentService.save(comment);

      //trigger the sub comment crawling
      this.subCommentService.startCrawling(commentDoc.get('id'));
    });

    usersRaw.forEach((userRaw: any) => {
      this.userService.save(this.userService.transformUserResponse(userRaw));
    });

    const commentIds: string[] = infos.map(
      (commentInfo: IComment) => commentInfo.id,
    );

    this.postService.addComments(commentIds, postId);

    //if there is next request to go
    if (nextParams) {
      asyncPriorityQueuePush(
        this.crawl,
        nextParams,
        Q_PRIORITY.CRAWLER_COMMENT,
      );
    }
  };

  private scrapeData(
    res: any,
    postId: string,
  ): {
    infos: IComment[];
    usersRaw: unknown[];
  } {
    const { comments } = res.data;
    const infos: IComment[] = comments.map((commentRaw: any) => {
      return {
        id: commentRaw.id,
        floorNumber: commentRaw.floorNumber, // or -1 if not exist
        content: commentRaw.content,
        subCommentsCount: commentRaw.subCommentsCount,
        user: commentRaw.user.id, // user id
        upvotesCount: commentRaw.upvotesCount,
        createTime: dayjs(commentRaw.createTime).valueOf(),
        subComments: commentRaw.subComments, // sub comment ids
        postId,
        saveTime: dayjs().valueOf(),
      };
    });
    const usersRaw: unknown[] = comments.map((commentRaw: any) => commentRaw.user);
    return {
      infos,
      usersRaw,
    };
  }

  private transformNextParams(
    res: any,
    params: CommentCrawlParams,
  ): CommentCrawlParams | null {
    const { postId, page, pageSize } = params;
    const { comments } = res.data;
    if (comments.length === 0) {
      // no more comments
      return null;
    }
    return {
      postId,
      page: page + 1,
      pageSize,
    };
  }
}

export { CommentCrawler };
