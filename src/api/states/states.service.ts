
import prisma from '../../lib/prisma';
import { CreateStateDto } from './states.dto';

export const getStates = async (languageId?: string) => {
  const where: { languageId?: string } = {};
  if (languageId) {
    where.languageId = languageId;
  }

  return await prisma.state.findMany({
    where,
  });
};

export const createState = async (state: CreateStateDto) => {
  return await prisma.state.create({
    data: {
      name: state.name,
      language: {
        connect: {
          id: state.languageId,
        },
      },
      country: {
        connect: {
          id: 'clufd0amp000008l43n34b2ou'
        }
      }
    },
  });
};
