
import { Strategy, ExtractJwt } from 'passport-jwt';
import { PassportStatic } from 'passport';
import { findUserById } from '../users/users.service';

const options = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET || 'your-default-secret',
};

export default (passport: PassportStatic) => {
  passport.use(
    new Strategy(options, async (payload, done) => {
      try {
        const user = await findUserById(payload.sub);
        if (user) {
          return done(null, user);
        }
        return done(null, false);
      } catch (error) {
        return done(error, false);
      }
    }),
  );
};
