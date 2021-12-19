import { crawlerAxios } from '../../../Config';
import { AxiosPromise } from 'axios';
import { NotImplementedError } from '../../../Error/ErrorClass';

/**
 * get a batch of comments
 */
function getCommentApi(postId:string,page:number,pageSize:number): AxiosPromise {
  /* axios config here */
  return crawlerAxios(`/api/comment`,{
    params:{
      postId,
      page,
      pageSize
    }
  })
}

export { getCommentApi };
