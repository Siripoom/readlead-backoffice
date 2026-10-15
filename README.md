# ReadLead Backoffice

Next.js 16 backoffice based on the supplied `admin.html` reference. It includes database-backed CMS, EXP review, user moderation, finance, reports, admin sessions and menu permissions.

## Getting Started

Set `DATABASE_URL`, `DATABASE_SSL` and a long random `SESSION_SECRET`, then run. Use `DATABASE_SSL=false` for the local Docker PostgreSQL service and `DATABASE_SSL=true` for a hosted database that requires TLS:

```bash
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The development seed owner account is `superadmin@readlead.com` / `ReadLead@123`; change this password before a production rollout.

Uploaded CMS images are stored in `public/uploads`. Deployments must provide persistent storage for this directory.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Private payload migration

The application writes v2 encrypted writer applications and withdrawal destinations. Existing v1 rows remain readable until migration. Keep `WRITER_APPLICATION_ENCRYPTION_KEY` unchanged and backed up separately from the database.

Back up the database, then run the default dry run against the intended environment:

```bash
npm run db:migrate-private-payloads
```

Check `legacy`, `wouldMigrate`, and `concurrent` counts. The command requires verified TLS for remote PostgreSQL. To write v2 envelopes after reviewing the dry run:

```bash
npm run db:migrate-private-payloads -- --apply
```

Run the dry run again. Both `legacy` counts must be zero. Each written envelope is decrypted and compared with its source before the database update. The update also checks that the source ciphertext has not changed. Do not roll back to a build that only reads v1 after v2 writes have begun. Keep a v2-capable rollback build and the encryption key available.
