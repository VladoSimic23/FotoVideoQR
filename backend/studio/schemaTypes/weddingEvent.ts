import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'weddingEvent',
  title: 'Wedding Event',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Event name',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'coupleNames',
      title: 'Couple names',
      type: 'string',
      description: 'Example: Ana & Marko',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Guest link slug',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'dashboardSlug',
      title: 'Dashboard slug',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'welcomeCopy',
      title: 'Welcome copy',
      type: 'text',
      rows: 4,
    }),
    defineField({
      name: 'ceremonyDate',
      title: 'Ceremony date',
      type: 'datetime',
    }),
    defineField({
      name: 'heroImage',
      title: 'Hero image',
      type: 'image',
      options: {
        hotspot: true,
      },
      fields: [
        defineField({
          name: 'alt',
          title: 'Alternative text',
          type: 'string',
        }),
      ],
    }),
    defineField({
      name: 'guestUploadEnabled',
      title: 'Allow guest uploads',
      type: 'boolean',
      initialValue: true,
    }),
    defineField({
      name: 'autoPublishApproved',
      title: 'Auto publish approved items',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'moderationMode',
      title: 'Moderation mode',
      type: 'string',
      options: {
        list: [
          {title: 'Review before showing', value: 'review'},
          {title: 'Show instantly', value: 'instant'},
          {title: 'Keep hidden until approved', value: 'hidden'},
        ],
      },
      initialValue: 'review',
    }),
    defineField({
      name: 'maxVideoSeconds',
      title: 'Max video length (seconds)',
      type: 'number',
      initialValue: 12,
      validation: (Rule) => Rule.min(1).max(60),
    }),
    defineField({
      name: 'accentColor',
      title: 'Accent color',
      type: 'string',
      description: 'Hex value used by the frontend theme',
    }),
    defineField({
      name: 'isActive',
      title: 'Active event',
      type: 'boolean',
      initialValue: true,
    }),
    defineField({
      name: 'notes',
      title: 'Internal notes',
      type: 'text',
      rows: 3,
    }),
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'coupleNames',
      media: 'heroImage',
    },
  },
})
