import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAllCountries = async (_req: Request, res: Response) => {
  try {
    const countries = await prisma.country.findMany();
    res.status(200).json(countries);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch countries' });
  }
};

export const createCountry = async (req: Request, res: Response) => {
  try {
    const { name, code } = req.body;
    const country = await prisma.country.create({ data: { name, code } });
    res.status(201).json(country);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create country' });
  }
};

export const getCountryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const country = await prisma.country.findUnique({ where: { id } });
    if (!country) return res.status(404).json({ error: 'Country not found' });
    res.status(200).json(country);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch country' });
  }
};

export const updateCountry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, code } = req.body;
    const country = await prisma.country.update({ where: { id }, data: { name, code } });
    res.status(200).json(country);
  } catch (error) {
    res.status(404).json({ error: 'Country not found or update failed' });
  }
};

export const deleteCountry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.country.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    res.status(404).json({ error: 'Country not found or delete failed' });
  }
};
