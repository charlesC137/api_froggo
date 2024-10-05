const router = require("express").Router();
const PostModel = require("../schemas/post-schema");

router.get("/search", async (req, res) => {
  const query = req.query.keyword || "";

  try {
    const results = await PostModel.find({
      title: { $regex: query, $options: "i" },
    }).exec();

    req.session.search = { query, results };

    if (results.length === 0) {
      res.sendStatus(204);
    } else {
      res.sendStatus(201);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json("Error searching for keyword");
  }
});

router.get("/fetch-search-results/:num", (req, res) => {
  if (!req.session.search) {
    return res.status(404).json("No search data found");
  }

  const searchResults = req.session.search.results;
  const searchQuery = req.session.search.query;

  let pageNo = parseInt(req.params.num) || 1;
  const postsPerPage = 4;
  const totalCount = searchResults.length;
  let skip;

  try {
    if (pageNo > totalCount || pageNo === 0) {
      skip = 0;
    } else {
      skip = (pageNo - 1) * postsPerPage;
    }

    const posts = searchResults.slice(skip, skip + postsPerPage);
    const postPageCount = Math.ceil(totalCount / postsPerPage);

    res.status(200).json({ posts, postPageCount, searchQuery });
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json("Error searching posts. Please try again later.");
  }
});

module.exports = router;
