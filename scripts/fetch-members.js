import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MEMBERS_API_URL = "https://who-tech.vercel.app/api/members";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputDir = path.join(__dirname, "..", "public");
const outputPath = path.join(outputDir, "members.json");

async function fetchMembers() {
  const response = await fetch(MEMBERS_API_URL);

  if (!response.ok) {
    throw new Error(
      `who-tech API 요청 실패: ${response.status} ${response.statusText}`,
    );
  }

  const members = await response.json();

  if (!Array.isArray(members)) {
    throw new Error("who-tech API 응답이 배열 형태가 아닙니다.");
  }

  return members.map((member) => ({
    githubId: member.githubId,
    nickname: member.nickname,
    cohort: member.cohort,
    roles: Array.isArray(member.roles) ? member.roles : [],
    track: member.track,
    avatarUrl: member.avatarUrl,
  }));
}

async function main() {
  try {
    const members = await fetchMembers();
    const payload = {
      generatedAt: new Date().toISOString(),
      members,
    };

    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);

    console.log(`총 ${members.length}명 저장 완료`);
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "알 수 없는 에러가 발생했습니다.",
    );
    process.exit(1);
  }
}

main();
