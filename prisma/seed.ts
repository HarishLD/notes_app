import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// Matches CLAUDE.md's auth rule so a seeded hash looks like a real one.
const BCRYPT_COST = 12;

// The reviewer test account. Credentials come from env vars, with defaults
// that are fine to commit because they only ever point at seed/dev data —
// never overridden with a real password in this file.
const REVIEWER_EMAIL = process.env.SEED_REVIEWER_EMAIL ?? "reviewer@example.com";
const REVIEWER_PASSWORD = process.env.SEED_REVIEWER_PASSWORD ?? "reviewer-seed-password";

type SeedNote = {
  title: string;
  body: string;
  tags: string[];
};

type SeedUser = {
  email: string;
  password: string;
  tags: string[];
  notes: SeedNote[];
};

const seedUsers: SeedUser[] = [
  {
    email: REVIEWER_EMAIL,
    password: REVIEWER_PASSWORD,
    tags: ["work", "personal", "ideas"],
    notes: [
      {
        title: "Welcome to the notes app",
        body: "This is the reviewer test account. Notes here are private to this account only.",
        tags: ["personal"],
      },
      {
        title: "Sprint planning",
        body: "Review the backlog and split the auth work from the notes work.",
        tags: ["work"],
      },
      {
        title: "Weekend project idea",
        body: "A tagging system for recipe cards, same schema shape as this app.",
        tags: ["ideas", "work"],
      },
      {
        title: "Groceries",
        body: "Milk, eggs, coffee.",
        tags: [],
      },
    ],
  },
  {
    email: "second-user@example.com",
    password: "second-seed-password",
    tags: ["travel", "recipes"],
    notes: [
      {
        title: "Trip to Lisbon",
        body: "Flights booked for June. Look into the tram routes.",
        tags: ["travel"],
      },
      {
        title: "Pasta with lemon and pepper",
        body: "Cacio e pepe, but with lemon zest stirred in at the end.",
        tags: ["recipes"],
      },
      {
        title: "Packing checklist",
        body: "Passport, adapter, hiking boots.",
        tags: ["travel", "recipes"],
      },
    ],
  },
];

async function seedUser(user: SeedUser): Promise<void> {
  const passwordHash = await bcrypt.hash(user.password, BCRYPT_COST);

  const dbUser = await prisma.user.upsert({
    where: { email: user.email },
    update: { passwordHash },
    create: { email: user.email, passwordHash },
  });

  // Reset this user's notes and tags so the seed is safe to run twice.
  // Deleting notes/tags cascades their join rows.
  await prisma.note.deleteMany({ where: { userId: dbUser.id } });
  await prisma.tag.deleteMany({ where: { userId: dbUser.id } });

  const tagIdByName = new Map<string, string>();
  for (const name of user.tags) {
    const tag = await prisma.tag.create({ data: { name, userId: dbUser.id } });
    tagIdByName.set(name, tag.id);
  }

  for (const note of user.notes) {
    await prisma.note.create({
      data: {
        title: note.title,
        body: note.body,
        userId: dbUser.id,
        noteTags: {
          create: note.tags.map((name) => {
            const tagId = tagIdByName.get(name);
            if (!tagId) {
              throw new Error(`Seed data error: note "${note.title}" references unknown tag "${name}"`);
            }
            return { tagId };
          }),
        },
      },
    });
  }
}

async function main(): Promise<void> {
  for (const user of seedUsers) {
    await seedUser(user);
  }
}

main()
  .then(async () => {
    console.log(`Seeded ${seedUsers.length} users.`);
    await prisma.$disconnect();
  })
  .catch(async (err: unknown) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
