module.exports = {
  purge: [],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        dark: "#24283b",
      },

      typography: (theme) => ({
        DEFAULT: {
          css: {
            color: theme("colors.gray.900"),
            a: {
              color: theme("colors.blue.700"),
              "&:hover": {
                color: theme("colors.blue.700"),
                textDecoration: "none",
              },
            },
          },
        },

        dark: {
          css: {
            color: "#7982a9",
            a: {
              color: "#9ECE6A",
              "&:hover": {
                color: "#9ECE6A",
              },
            },
          },
        },
      }),
    },
  },
  variants: {
    typography: ["dark"],
    extend: {
      opacity: ["disabled"],
    },
  },
  plugins: [],
};
