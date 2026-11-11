package io.github.evan0x.syllacal.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SpaController {

	@GetMapping({"/terms", "/privacy", "/calendar", "/workload"})
	public String legalPage() {
		return "forward:/index.html";
	}
}
