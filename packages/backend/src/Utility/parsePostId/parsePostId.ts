import isUrl from 'is-url';
import cheerio from 'cheerio';
import { URL } from 'url';
import _ from 'lodash';
import { BadRequestError, NotImplementedError } from '../../Error/ErrorClass';

/**
 * get post id from url
 * @param urlStr possible post url
 * @returns the post id, if it's not a valid post url, return empty string ""
 */
export async function parsePostId(urlStr: string): Promise<string> {
  // https://head-book.ml/post/610fc547-1f2b-477a-b292-c97601c9ba45/comments?page=1&pageSize=10
  const urlObj = new URL(urlStr);
  const pathName:string = urlObj.pathname;
  const pathArr:string[] = pathName.split('/');
  return pathArr[2] || "";
}
