import {defineField, defineType} from 'sanity'

export default defineType({
  name: 'mediaSubmission',
  title: 'Media Submission',
  type: 'document',
  fields: [
    defineField({
      name: 'weddingEvent',
      title: 'Wedding event',
      type: 'reference',
      to: [{type: 'weddingEvent'}],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'guestName',
      title: 'Guest name',
      type: 'string',
      description: 'Optional, for the couple to see who uploaded it',
    }),
    defineField({
      name: 'mediaKind',
      title: 'Media type',
      type: 'string',
      options: {
        list: [
          {title: 'Photo', value: 'image'},
          {title: 'Video', value: 'video'},
        ],
      },
      initialValue: 'image',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'status',
      title: 'Review status',
      type: 'string',
      options: {
        list: [
          {title: 'Pending review', value: 'pending'},
          {title: 'Approved', value: 'approved'},
          {title: 'Hidden', value: 'hidden'},
          {title: 'Rejected', value: 'rejected'},
        ],
      },
      initialValue: 'pending',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'visibleInGallery',
      title: 'Visible in gallery',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'image',
      title: 'Image',
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
      name: 'video',
      title: 'Video',
      type: 'file',
      options: {
        accept: 'video/*',
      },
    }),
    defineField({
      name: 'videoCompat',
      title: 'Video (compatibility MP4)',
      type: 'file',
      description:
        'Optional transcoded fallback for older devices. Prefer this for playback when available.',
      options: {
        accept: 'video/mp4',
      },
    }),
    defineField({
      name: 'caption',
      title: 'Caption',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'reviewNote',
      title: 'Review note',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'capturedAt',
      title: 'Captured at',
      type: 'datetime',
    }),
    defineField({
      name: 'approvedAt',
      title: 'Approved at',
      type: 'datetime',
    }),
    defineField({
      name: 'durationSeconds',
      title: 'Duration seconds',
      type: 'number',
      description: 'Useful for short guest videos up to 12 seconds',
    }),
  ],
  preview: {
    select: {
      title: 'guestName',
      subtitle: 'mediaKind',
      media: 'image',
    },
    prepare({title, subtitle}) {
      return {
        title: title || 'Guest submission',
        subtitle,
      }
    },
  },
})
