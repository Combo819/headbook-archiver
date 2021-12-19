import { crawlerAxios } from '../../../Config';
import { AxiosPromise } from 'axios';

function getSubCommentApi(
  commentId: string,
  page: number,
  pageSize: number,
): AxiosPromise {
  return crawlerAxios({
    url: `/api/subComment`,
    params: {
      commentId,
      page,
      pageSize,
    },
  });
}

export { getSubCommentApi };
