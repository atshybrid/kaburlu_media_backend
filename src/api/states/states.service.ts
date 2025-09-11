
import prisma from '../../lib/prisma';
import { CreateStateDto } from './states.dto';

export const getStates = async (languageId?: string) => {
  return await prisma.state.findMany();
};

export const createState = async (state: CreateStateDto) => {
  return await prisma.state.create({
    data: {
      name: state.name,
  country: { connect: { name: 'India' } }, // connect by unique field
    },
  });
};
