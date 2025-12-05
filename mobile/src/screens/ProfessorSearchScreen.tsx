marginHorizontal: SPACING.l,
    borderRadius: 12,
        paddingHorizontal: SPACING.m,
            height: 48,
    },
searchIcon: {
    marginLeft: SPACING.s,
    },
searchInput: {
    flex: 1,
        fontSize: 16,
            color: COLORS.text,
                textAlign: 'right',
    },
centerContainer: {
    flex: 1,
        justifyContent: 'center',
            alignItems: 'center',
    },
list: {
    padding: SPACING.l,
    },
card: {
    backgroundColor: COLORS.surface,
        borderRadius: 16,
            padding: SPACING.m,
                marginBottom: SPACING.m,
        ...SHADOWS.small,
    },
cardContent: {
    flexDirection: 'row',
        alignItems: 'center',
            justifyContent: 'space-between',
    },
avatarContainer: {
    width: 48,
        height: 48,
            borderRadius: 24,
                backgroundColor: '#EEF2FF',
                    justifyContent: 'center',
                        alignItems: 'center',
    },
name: {
    fontSize: 16,
        fontWeight: 'bold',
            color: COLORS.text,
                marginBottom: 4,
    },
email: {
    fontSize: 14,
        color: COLORS.textSecondary,
    },
emptyContainer: {
    alignItems: 'center',
        marginTop: 40,
    },
emptyText: {
    fontSize: 16,
        color: COLORS.textSecondary,
    },
});
