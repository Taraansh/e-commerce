import { InjectModel } from '@nestjs/mongoose';
import { Users } from '../schema/users';
import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UserRepository {
  constructor(
    @InjectModel(Users.name) private readonly userModel: Model<Users>,
  ) {}

  async findOne(query: any) {
    return this.userModel.findOne(query);
  }

  async create(data: Record<string, any>) {
    return this.userModel.create(data);
  }

  async updateOne(query: any, data: Record<string, any>) {
    return this.userModel.updateOne(query, data);
  }

  async find(query: any) {
    return this.userModel.find(query);
  }

  async findById(id: string) {
    return this.userModel.findById(id);
  }
}
