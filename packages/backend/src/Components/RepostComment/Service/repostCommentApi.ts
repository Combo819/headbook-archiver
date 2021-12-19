import { crawlerAxios } from '../../../Config';
import { AxiosPromise } from 'axios';

/**
 *
 */
function getRepostCommentApi(
  postId: string,
  page: number,
  pageSize: number,
): AxiosPromise {
  return crawlerAxios({
    url: `/api/repostComment`,
    method: 'get',
    params: {
      postId,
      page,
      pageSize,
    },
  });
}

export { getRepostCommentApi };
