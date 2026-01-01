
import { Request, Response } from 'express';
import { getStates, createState } from './states.service';
import { CreateStateDto } from './states.dto';
import { validate } from 'class-validator';

export const getStatesController = async (req: Request, res: Response) => {
  try {
    const states = await getStates();
    res.status(200).json({ success: true, data: states });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const createStateController = async (req: Request, res: Response) => {
  try {
    const createStateDto = new CreateStateDto(req.body.name, req.body.languageId);

    const errors = await validate(createStateDto);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const state = await createState(createStateDto);
    res.status(201).json({ success: true, message: 'State created successfully', data: state });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
