const initialsOf = (name = '') =>
  name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => '\\' + c);

// Indian university domains (.edu, .ac.in, .edu.in …) count as "verified student"
const isUniversityEmail = (email) => /\.(edu|ac\.[a-z]{2,3}|edu\.[a-z]{2,3})$/i.test(email);

const paginate = ({ page = 1, limit = 20 }) => ({ limit, offset: (page - 1) * limit, page });

module.exports = { initialsOf, escapeLike, isUniversityEmail, paginate };
