import { parseFollowersCount } from './../../../Utility/parseFollowersCount/parseFollowersCount';
import camelcaseKeys from 'camelcase-keys';
import { inject, injectable } from 'inversify';
import _ from 'lodash';
import 'reflect-metadata';
import { MangoQuery, MangoQuerySelector } from 'rxdb';
import { logger } from '../../../Logger';
import { processJsonAsStream } from '../../../Utility/json';
import { ImageServiceInterface, IMAGE_IOC_SYMBOLS } from '../../Image/Types';
import { userMigration } from '../DAL';
import {
  IUser,
  UserDocument,
  IUserService,
  IUserDAL,
  USER_IOC_SYMBOLS,
} from '../Types';
import { getUserIdByUsernameApi, getUserInfoByIdApi } from './userApi';
import { migrate } from '../../../Utility/migrate/migrate';
import { NotImplementedError } from '../../../Error/ErrorClass';
import { getUrlLastSegment } from '../../../Utility/urlParse';
import { BASE_URL } from '../../../Config';

@injectable()
class UserService implements IUserService {
  private userDAL: IUserDAL;
  private imageService: ImageServiceInterface;
  constructor(
    @inject(USER_IOC_SYMBOLS.IUserDAL) userDAL: IUserDAL,
    @inject(IMAGE_IOC_SYMBOLS.ImageServiceInterface)
    imageService: ImageServiceInterface,
  ) {
    this.userDAL = userDAL;
    this.imageService = imageService;
  }
  save = async (userInfo: IUser) => {
    const userDoc: UserDocument = await this.userDAL.upsert(userInfo);
    this.imageService.downloadImage(userInfo.image.originUrl);
    return userDoc;
  };

  transformUserResponse(userRaw: any): IUser {
    const userInfo = {
      id: userRaw.id,
      username: userRaw.username,
      profileUrl: userRaw.profileUrl,
      gender: userRaw.gender,
      followersCount: userRaw.followersCount,
      followingCount: userRaw.followingCount,
      image: {
        name: userRaw.image.name,
        originUrl: BASE_URL + '/images/' + userRaw.image.name,
      },
    };
    return userInfo;
  }

  async getUserByName(name: string): Promise<IUser[]> {
    let selector: MangoQuerySelector = {};
    if (name) {
      selector = { screenName: name };
    }

    const userDocs: UserDocument[] = await this.userDAL.query({ selector });
    return userDocs.map((userDoc) => userDoc.toJSON());
  }

  async countUserByName(name: string): Promise<number> {
    const selector: MangoQuerySelector = { screenName: name };
    const userDocs: UserDocument[] = await this.userDAL.query({ selector });
    return userDocs.length;
  }

  /**
   * fetch a user. if it's in database, retrieve it from the database.
   * otherwise get from the platform server and store in to database
   * @param userId
   * @returns
   */
  async fetchUser(userId: string): Promise<UserDocument | null> {
    const userDoc: UserDocument | null = await this.userDAL.findOneById(userId);
    if (userDoc) return userDoc;
    try {
      const userRaw = await getUserInfoByIdApi(userId);

      if (userRaw) {
        const userDoc: UserDocument = await this.save(
          this.transformUserResponse(userRaw),
        );
        return userDoc;
      }
    } catch (error) {
    } finally {
      return null;
    }
  }

  async getUserIdByName(username: string): Promise<string | ''> {
    let userId: string = '';
    try {
      userId = await getUserIdByUsernameApi(username);
    } finally {
      return userId;
    }
  }

  async importData(
    filePath: string,
    version: number,
    batchSize: number,
  ): Promise<void> {
    const worker = async (values: { value: IUser & { _rev: string } }[]) => {
      const infos = values.map((item) => item.value);
      const migratedInfos = migrate<IUser>(infos, version, userMigration);
      const newMig: IUser[] = migratedInfos.map((info) => {
        return _.omit(info, ['_rev']);
      }) as IUser[];
      const result = await this.userDAL.bulkInsert(newMig);
      logger.info(`imported users: ${result.success.length}`);
      if (result.error.length > 0) {
        logger.error(`importing users error: ${result.error.length}`);
        logger.error(`First error info: ${result.error[0]}`);
      }
    };

    await processJsonAsStream<IUser>(filePath, batchSize, worker);
  }

  exportData() {
    return this.userDAL.exportData();
  }

  getVersion() {
    return this.userDAL.getVersion();
  }

  startCrawling(id: string): never {
    throw new NotImplementedError(
      `startCrawling in UserService is not implemented`,
    );
  }

  getOneByIdPopulated(id: string): never {
    throw new NotImplementedError(
      `getOneByIdPopulated in UserService is not implemented`,
    );
  }
  queryPopulated(queyr: MangoQuery): never {
    throw new NotImplementedError(
      `queryPopulated in UserService is not implemented`,
    );
  }
  count(selector: MangoQuerySelector): never {
    throw new NotImplementedError(`count in UserService is not implemented`);
  }
}

export { UserService };
