package io.github.evan0x.syllacal.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class GitHubVerifiedEmailTest {

	@Test
	void primaryVerifiedEmailIsChosen() {
		String email = GitHubVerifiedEmailUserService.chooseVerifiedEmail(new GitHubVerifiedEmailUserService.GitHubEmail[] {
				new GitHubVerifiedEmailUserService.GitHubEmail("other@school.edu", false, true),
				new GitHubVerifiedEmailUserService.GitHubEmail("primary@school.edu", true, true),
				new GitHubVerifiedEmailUserService.GitHubEmail("hidden@school.edu", true, false)
		});

		assertThat(email).isEqualTo("primary@school.edu");
	}

	@Test
	void unverifiedEmailsAreIgnored() {
		assertThat(GitHubVerifiedEmailUserService.chooseVerifiedEmail(new GitHubVerifiedEmailUserService.GitHubEmail[] {
				new GitHubVerifiedEmailUserService.GitHubEmail("hidden@school.edu", true, false)
		})).isNull();
		assertThat(GitHubVerifiedEmailUserService.chooseVerifiedEmail(null)).isNull();
		assertThat(GitHubVerifiedEmailUserService.chooseVerifiedEmail(new GitHubVerifiedEmailUserService.GitHubEmail[0]))
				.isNull();
	}
}
