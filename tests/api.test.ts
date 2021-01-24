import { signMessage } from "../api";

test("signMessage", async () => {
  const res = await signMessage("TEST", "pass");
  expect(res).toBe(
    "cf058948d1312892fd62e3abcbf4d130e20b7563d3be2ae50309e18e00061c17",
  );
});
