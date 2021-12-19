import { crawlerAxios } from '../../../Config';
import { AxiosPromise } from 'axios';
function getPostApi(postId: string): AxiosPromise {
  return crawlerAxios(`/api/post/${postId}`);
}

export { getPostApi };
