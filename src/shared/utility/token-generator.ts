import jwt from 'jsonwebtoken';
import config from 'config';

export const generateAuthToken = (id: string) => {
  return jwt.sign({ _id: id }, config.get('jwtSecret'), { expiresIn: '30d' });
};

export const decodeAuthToken = (token: string) => {
  return jwt.verify(token, config.get('jwtSecret'));
};
